const { requireAdmin } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { writeFile } = require('../github');
const { markRulesUploaded } = require('../settings');

// The rules document is committed straight into the repo (frontend/rules.pdf)
// rather than stored in the database or a separate blob service -- it's a
// single small file that almost never changes, so a versioned repo file is
// simpler and free.
module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  requireAdmin(req);
  const { base64 } = req.body || {};
  if (!base64 || typeof base64 !== 'string') throw new HttpError(400, 'base64 file content is required');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new HttpError(400, 'File is empty');
  if (buffer.length > 8 * 1024 * 1024) throw new HttpError(400, 'File is too large (max 8MB)');
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new HttpError(400, 'File must be a PDF');
  }

  await writeFile('frontend/rules.pdf', base64, 'Upload tournament rules document (admin)');
  const settings = await markRulesUploaded('admin');
  res.status(200).json({ uploaded: true, rulesUploadedAt: settings.rulesUploadedAt });
});
