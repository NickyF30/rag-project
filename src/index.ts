import app from './app';
import 'dotenv/config';

const PORT = 8080;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});