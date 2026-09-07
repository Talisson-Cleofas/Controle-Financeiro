const router = require('express').Router();
const auth = require('../middlewares/auth');
const { readData, writeData } = require('../services/financial-data');
const { requireWriteAccess } = require('../services/billing-access');
router.use(auth);
router.get('/', async (req,res,next) => {
  try { res.json(await readData(req.user._id)); } catch (error) { next(error); }
});
router.put('/', requireWriteAccess, async (req,res,next) => {
  try { const { revision } = await writeData(req.user._id,req.body); res.json({ revision }); } catch (error) { next(error); }
});
module.exports = router;
