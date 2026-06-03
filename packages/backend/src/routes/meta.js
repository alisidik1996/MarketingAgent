/**
 * Meta routes — binds HTTP endpoints to controller methods.
 * All protected routes use the requireToken middleware.
 */
import { Router } from 'express';
import { requireToken } from '../middleware/auth.js';
import {
  tokenInspect,
  tokenExtend,
  account,
  campaigns,
  insights,
  adsets,
  ads,
} from '../controllers/metaController.js';

const router = Router();

// Token management (no auth required — uses app credentials)
router.post('/token/inspect', tokenInspect);
router.post('/token/extend',  tokenExtend);

// Protected Meta data endpoints
router.post('/account',   requireToken, account);
router.post('/campaigns', requireToken, campaigns);
router.post('/insights',  requireToken, insights);
router.post('/adsets',    requireToken, adsets);
router.post('/ads',       requireToken, ads);

export default router;
