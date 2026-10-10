import type { RequestHandler, Response } from 'express';
import { currentCustomer } from '../../common/middlewares/authorize.js';
import { AppError } from '../../common/errors/app-error.js';
import type { InvitationRow } from './invitation.repository.js';
import { invitationRepository } from './invitation.repository.js';
import { invitationService } from './invitation.service.js';

/**
 * For routers nested under /:invitationId. The loaded invitation is put on
 * res.locals so handlers do not query it again.
 */
export const loadCustomerInvitation: RequestHandler = async (req, res, next) => {
  res.locals.invitation = await invitationService.getOwnedOrThrow(
    currentCustomer(req).id,
    Number(req.params.invitationId),
  );
  next();
};

export const loadAnyInvitation: RequestHandler = async (req, res, next) => {
  const invitation = await invitationRepository.findById(Number(req.params.invitationId));
  if (!invitation) throw AppError.notFound('Invitation not found');
  res.locals.invitation = invitation;
  next();
};

/** Guest management and e-mailing unlock once the sales team marks the invitation paid. */
export const requirePaidInvitation: RequestHandler = (_req, res, next) => {
  if (loadedInvitation(res).status !== 'paid') {
    throw AppError.conflict(
      'Guest invitations become available after your payment has been confirmed',
      'PAYMENT_REQUIRED',
    );
  }
  next();
};

export function loadedInvitation(res: Response): InvitationRow {
  const invitation = res.locals.invitation as InvitationRow | undefined;
  if (!invitation) throw new Error('loadCustomerInvitation / loadAnyInvitation must run first');
  return invitation;
}
