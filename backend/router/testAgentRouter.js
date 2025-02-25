import express from 'express';
import { createAgent } from '../controller/testAgentControllers.js';

const router = express.Router();


// Agent routes
router.post('/create-agent', createAgent);

export default router;