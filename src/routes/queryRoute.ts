import express from 'express';
import { queryDocuments } from '../services/queryService';

const router = express.Router();

router.post('/', async (req, res) => {
    const result = await queryDocuments(req);
    res.json(result);
});

export default router;