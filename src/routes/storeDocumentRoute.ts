import express from 'express';
import { storeDocument } from '../services/storeDocumentService';

const router = express.Router();

router.post('/', async (req, res) => {
    const result = await storeDocument(req);
    res.json(result);
});

export default router;