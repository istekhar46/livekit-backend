import express from 'express';
import { createAgent, createInboundTrunk, listAllInboundTrunks } from '../controller/testAgentControllers.js';

const router = express.Router();


// Agent routes
router.post('/create-agent', createAgent);
router.post('/create-inboundtrunks', createInboundTrunk);
router.get('/list-inboudtrunks', listAllInboundTrunks);

export default router;