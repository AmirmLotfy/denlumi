import { authenticateToken } from '../../../packages/domain/auth';
import { DomainError } from '../../../packages/domain/db';
import { cookie, guard, rateLimit } from './http';
// Human-management operations require the app session cookie and same-origin request.
// They are intentionally absent from the model/MCP tool surface.
export async function householdActor(req:Request,requireOrigin=true) {
 guard(req,requireOrigin);
 const token=cookie(req);if(!token)throw new DomainError('UNAUTHORIZED',401);
 const actor=await authenticateToken(token);rateLimit(`household:${actor.userId}`,30);return actor;
}
export const requestKey=(req:Request)=>req.headers.get('idempotency-key')??'';
