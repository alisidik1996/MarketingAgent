/**
 * Route aggregator — mounts all sub-routers under their base paths.
 * Import this once in index.js instead of registering routes individually.
 */
import { Router } from 'express';
import metaRoutes from './meta.js';

const router = Router();

router.use('/meta', metaRoutes);

export default router;
