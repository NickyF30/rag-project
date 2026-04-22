import express from 'express';
import cors from 'cors';
import storeDocumentRoute from './routes/storeDocumentRoute';
import queryRoute from './routes/queryRoute';

const app = express();

app.use(express.json());
app.use(cors());

app.use('/store-document', storeDocumentRoute);
app.use('/query', queryRoute);

export default app;