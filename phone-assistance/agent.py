from __future__ import annotations

import asyncio
import logging
import os
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from livekit import rtc, api
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
)
from livekit.protocol import sip as proto_sip
from livekit.agents.voice_assistant import VoiceAssistant  
from livekit.plugins import openai, silero, deepgram, elevenlabs  

load_dotenv(dotenv_path=".env.local")

# Initialize logging
logger = logging.getLogger("phone-assistant")
logger.setLevel(logging.INFO)


class PhoneAssistant:
    """
    A voice-enabled phone assistant that handles voice interactions and transfers calls
    based on conversation context using function calling.
    """

    def __init__(self, context: JobContext):
        """
        Initialize the PhoneAssistant with the context about the room, participant, etc.

        Args:
            context (JobContext): The context for the job.
        """
        self.context = context
        self.assistant = None
        self.livekit_api = None
        self.participant_identity = None
        # Define department mapping
        self.departments = {
            "billing": ("BILLING_PHONE_NUMBER", "Billing"),
            "technical_support": ("TECH_SUPPORT_PHONE_NUMBER", "Technical Support"),
            "customer_service": ("CUSTOMER_SERVICE_PHONE_NUMBER", "Customer Service"),
        }
        self.waiting_for_disconnect = asyncio.Event()

    async def say(self, message: str) -> None:
        """
        Ask the assistant to speak a message to the user.

        Args:
            message (str): The message to say.
        """
        if hasattr(self.assistant, 'say'):
            await self.assistant.say(message)
            logger.debug(f"Asked assistant to say: {message}")

    async def connect_to_room(self) -> rtc.Participant:
        """
        Connect to the LiveKit room and wait for a participant to join.

        Returns:
            rtc.Participant: The connected participant.
        """
        room_name = self.context.room.name
        logger.info(f"Connecting to room: {room_name}")
        await self.context.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        participant = await self.context.wait_for_participant()
        self.participant_identity = participant.identity
        
        # Register disconnect handler
        @self.context.room.on("disconnected")
        def on_room_disconnect(*args):
            self.waiting_for_disconnect.set()
            
        return participant

    async def _handle_transfer(self, department_key: str, reason: Optional[str] = None) -> None:
        """
        Handle the transfer process with department-specific messaging.

        Args:
            department_key (str): The key for the department in self.departments
            reason (Optional[str]): The reason for the transfer
        """
        if department_key not in self.departments:
            logger.error(f"Unknown department key: {department_key}")
            await self.say("I'm sorry, I couldn't transfer your call due to a system error. Is there something else I can help with?")
            return
            
        env_var, dept_name = self.departments[department_key]
        transfer_number = f"tel:{os.getenv(env_var)}"
        
        transfer_message = f"I'm transferring you to our {dept_name} department"
        if reason:
            transfer_message += f" to help with {reason}"
        transfer_message += ". Please hold while I connect you."
        
        await self.say(transfer_message)
        await asyncio.sleep(3)
        await self.transfer_call(self.participant_identity, transfer_number)

    class TransferFunctionContext(llm.FunctionContext):
        """
        Function context for the transfer_call function.
        """
        def __init__(self, phone_assistant_instance):
            super().__init__()
            self.phone_assistant = phone_assistant_instance
            self.functions = [self.transfer_call]

        @llm.ai_callable(description="Transfer the caller to a specific department based on their needs")
        async def transfer_call(self, department: str, reason: Optional[str] = None, confidence: float = 0.95) -> str:
            """
            Transfer the call to a specific department.
            
            Args:
                department (str): The department to transfer to
                reason (Optional[str]): The reason for the transfer
                confidence (float): Confidence level (0-1) that this is the right department
                
            Returns:
                str: Result of the transfer attempt
            """
            logger.info(f"Transfer call requested: department={department}, reason={reason}, confidence={confidence}")
            
            # Always transfer when explicitly requested
            if department in self.phone_assistant.departments:
                await self.phone_assistant._handle_transfer(department, reason)
                return f"Call transferred to {department} department"
            else:
                # Ask for clarification on invalid department
                await self.phone_assistant.say("I'm sorry, I couldn't identify which department you need. Could you please specify if you need billing, technical support, or customer service?")
                return "Requested department clarification from caller"

    def start_agent(self, participant: rtc.Participant) -> None:
        """
        Initialize and start the voice assistant with function calling capability.

        Args:
            participant (rtc.Participant): The participant to interact with.
        """
        # Create system prompt
        system_prompt = (
            "You are a friendly assistant for Rapid-innovation, a global leader in fine AI Solutions. "
            "Your job is to help callers with their inquiries and transfer them to the appropriate department when needed. "
            "\n\nYou should:\n"
            "1. Listen carefully to customer inquiries\n"
            "2. Attempt to help with simple questions\n"
            "3. When the customer's need requires specialized assistance, use the transfer_call function\n"
            "4. When customers explicitly ask to be transferred to a department, ALWAYS use the transfer_call function with high confidence\n"
            "5. When transferring, always set confidence to 0.95 to ensure the transfer goes through\n"
            "\n"
            "Available departments:\n"
            "- billing: For payment issues, invoices, account charges, refunds\n"
            "- technical_support: For product troubleshooting, technical issues, installation help\n"
            "- customer_service: For general inquiries, complaints, feedback, orders"
        )
        
        # Create initial chat context
        initial_ctx = llm.ChatContext().append(
            role="system",
            text=system_prompt,
        )
        
        # Create function context
        fnc_ctx = self.TransferFunctionContext(self)
        
        # Initialize the VoiceAssistant
        self.assistant = VoiceAssistant(
            vad=silero.VAD.load(),  # Voice Activity Detection
            stt=deepgram.STT(),      # Speech-to-Text
            llm=openai.LLM(
                model="gpt-4o",  # Use GPT-4 for language model
                temperature=0.7,
                tool_choice="auto"  # Enable function calling
            ),
            tts=elevenlabs.TTS(model="eleven_flash_v2_5", streaming_latency=1),
            chat_ctx=initial_ctx,
            fnc_ctx=fnc_ctx,
        )
        
        # Start the voice assistant
        self.assistant.start(self.context.room)
        self.assistant.say(
            "Hi, thanks for calling Rapid-innovation — global leader in fine AI solutions! "
            "How can I help you today?")

    async def transfer_call(self, participant_identity: str, transfer_to: str) -> None:
        """
        Transfer the SIP call to another number. This will essentially end the current call and start a new one,
        the PhoneAssistant will no longer be active on the call.

        Args:
            participant_identity (str): The identity of the participant.
            transfer_to (str): The phone number to transfer the call to.
        """
        logger.info(f"Transferring call for participant {participant_identity} to {transfer_to}")

        try:
            # Initialize LiveKit API client if not already done
            if not self.livekit_api:
                livekit_url = os.getenv('LIVEKIT_URL')
                api_key = os.getenv('LIVEKIT_API_KEY')
                api_secret = os.getenv('LIVEKIT_API_SECRET')
                logger.debug(f"Initializing LiveKit API client with URL: {livekit_url}")
                self.livekit_api = api.LiveKitAPI(
                    url=livekit_url,
                    api_key=api_key,
                    api_secret=api_secret
                )

            # Create transfer request
            transfer_request = proto_sip.TransferSIPParticipantRequest(
                participant_identity=participant_identity,
                room_name=self.context.room.name,
                transfer_to=transfer_to,
                play_dialtone=True
            )
            logger.debug(f"Transfer request: {transfer_request}")

            # Perform transfer
            await self.livekit_api.sip.transfer_sip_participant(transfer_request)
            logger.info(f"Successfully transferred participant {participant_identity} to {transfer_to}")

        except Exception as e:
            logger.error(f"Failed to transfer call: {e}", exc_info=True)
            await self.say("I'm sorry, I couldn't transfer your call. Is there something else I can help with?")

    async def cleanup(self) -> None:
        """
        Clean up resources before shutting down.
        """
        if self.livekit_api:
            await self.livekit_api.aclose()
            self.livekit_api = None

# Only define this function once
def prewarm_process(proc: JobProcess):
    """Prewarm the process by loading VAD."""
    proc.userdata["vad"] = silero.VAD.load()

async def entrypoint(context: JobContext) -> None:
    """
    The main entry point for the phone assistant application.

    Args:
        context (JobContext): The context for the job.
    """
    assistant = PhoneAssistant(context)

    try:
        participant = await assistant.connect_to_room()
        assistant.start_agent(participant)
        
        # Wait until the room is disconnected
        await assistant.waiting_for_disconnect.wait()
    except Exception as e:
        logger.error(f"Error in entrypoint: {e}", exc_info=True)
    finally:
        await assistant.cleanup()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm_process
    ))