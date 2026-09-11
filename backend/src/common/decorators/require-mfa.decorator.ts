import { SetMetadata } from '@nestjs/common';
export const REQUIRE_MFA_KEY = 'requireMFA';
export const RequireMFA = () => SetMetadata(REQUIRE_MFA_KEY, true);
