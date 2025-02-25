import express from 'express';
import { getToken } from '../controller/authControllers.js';

const router = express.Router();

// Auth routes
router.post('/getToken', getToken);

export default router;