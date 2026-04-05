import { Router } from 'express';
import contentRouter from './content.js';
import filesRouter from './files.js';
import settingsRouter from './settings.js';

const router = Router();

router.use('/content', contentRouter);
router.use('/files', filesRouter);
router.use('/settings', settingsRouter);

export default router;
