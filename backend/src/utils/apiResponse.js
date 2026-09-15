const ok = (res, data, message = 'Success', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

const created = (res, data, message = 'Created') => ok(res, data, message, 201);

const fail = (res, message = 'Something went wrong', status = 400, errors = null) => {
  return res.status(status).json({ success: false, message, errors });
};

module.exports = { ok, created, fail };
