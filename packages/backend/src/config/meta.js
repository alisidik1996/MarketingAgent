/**
 * Backend configuration — Meta API settings loaded from env.
 */
export const META_VERSION = 'v20.0';
export const META_BASE    = `https://graph.facebook.com/${META_VERSION}`;
export const APP_ID       = process.env.META_APP_ID;
export const APP_SECRET   = process.env.META_APP_SECRET;

export const CPAS_EXTRA_FIELDS =
  ',catalog_segment_actions,catalog_segment_value,catalog_segment_value_omni_purchase_roas';
