/**
 * Dashboard module — public API barrel.
 * Import from this file, not from individual sub-modules.
 *
 * Usage:
 *   import { state, loadDashboard, initEvents } from './modules/dashboard/index.js';
 */
export { state }                                            from './state.js';
export { TokenManager }                                     from './tokenManager.js';
export { loadDashboard, initEvents }                        from './controller.js';
export { showError, showLoading, hideLoading,
         applyFiltersAndSort, renderTablePage,
         openDrawer, closeDrawer, renderAccountBar }        from './renderer.js';
