import 'server-only';

export {
  CAPTURE_LIMITS,
  WEBSITE_CAPTURE_PATH,
  verifyMetaChallenge,
  verifyMetaLeadNotices,
  verifyWebsiteCapture,
} from './verification';
export type { MetaLeadNotice, WebsiteCapture } from './verification';