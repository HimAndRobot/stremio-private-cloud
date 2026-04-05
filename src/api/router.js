import { Router } from 'express';
import contentRouter from './content.js';
import filesRouter from './files.js';

const router = Router();

router.use('/content', contentRouter);
router.use('/files', filesRouter);

export default router;
