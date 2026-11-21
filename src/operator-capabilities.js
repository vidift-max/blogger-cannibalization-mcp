/*
 * Remote-operation safety contract.
 *
 * This is intentionally capability-oriented: preparing a draft is distinct
 * from approving or publishing it. A future remote browser/operator can use
 * these capabilities without receiving implicit publication permission.
 */

export const OPERATOR_CAPABILITIES = Object.freeze({
  inspect: Object.freeze(['read_workspace', 'read_editorial_context']),
  prepare: Object.freeze(['create_draft', 'import_claude_html', 'edit_content', 'edit_metadata', 'request_preview']),
  approval: Object.freeze(['request_approval']),
  publish: Object.freeze(['publish_approved_content'])
});

export function createOperatorSession({ remote = false, userApproved = false } = {}) {
  return {
    remote: Boolean(remote),
    user_approved: Boolean(userApproved),
    capabilities: {
      inspect: [...OPERATOR_CAPABILITIES.inspect],
      prepare: [...OPERATOR_CAPABILITIES.prepare],
      approval: [...OPERATOR_CAPABILITIES.approval],
      publish: []
    }
  };
}

export function grantPublishCapability(session) {
  if (!session || session.user_approved !== true) {
    throw new Error('explicit_user_approval_required');
  }

  session.capabilities.publish = [...OPERATOR_CAPABILITIES.publish];
  return session;
}

export function canOperatorPublish(session) {
  return Boolean(session?.capabilities?.publish?.includes('publish_approved_content'));
}
