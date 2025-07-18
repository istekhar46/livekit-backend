import express from 'express';
import { createAgent, createInboundTrunk, deleteInboundTrunk, listAllInboundTrunks, createDispatchRule } from '../controller/testAgentControllers.js';

const router = express.Router();


// Agent routes
router.post('/create-agent', createAgent);
router.post('/create-inboundtrunks', createInboundTrunk);
router.get('/list-inboudtrunks', listAllInboundTrunks);
router.post("/delete-inboundtrunks/:trunkId", deleteInboundTrunk);
router.post('/create-dispatch-rule', createDispatchRule);

export default router;