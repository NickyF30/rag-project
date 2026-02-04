import express from 'express';
import cors from 'cors';
import storeDocumentRoute from './routes/storeDocumentRoute';

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// Routes
app.use('/store-document', storeDocumentRoute);


export default app;