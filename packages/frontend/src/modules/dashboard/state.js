/**
 * Dashboard state — single source of truth for the Meta Ads module.
 * Exported as a mutable object; update properties directly.
 */
import { DEFAULT_ACCOUNT } from '../../lib/config.js';

export const state = {
  accountId:         DEFAULT_ACCOUNT,
  accountName:       '',
  accountCurrency:   'IDR',
  activeAdGroup:     'Regular Ads',
  campaigns:         [],
  filteredCampaigns: [],
  insightMap:        {},
  campaignMeta:      {},
  currentPage:       1,
  sortKey:           'spend',
  sortDir:           'desc',
  dateRange:         'last_7d',
  drawerCampaignId:  null,
  drawerTab:         'adsets',
  _dailyData:        [],
  _campaignInsights: [],
};
