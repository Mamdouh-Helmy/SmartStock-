const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // البحث عن المستخدم
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'اسم المستخدم غير موجود' });
    }

    // التحقق من كلمة المرور
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('🔹 نتيجة مقارنة كلمة المرور:', passwordMatch);

    if (!passwordMatch) {
      console.log('❌ كلمة المرور غير صحيحة');
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }

    // إنشاء توكن JWT عند نجاح تسجيل الدخول
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });

    console.log('✅ تم تسجيل الدخول بنجاح');
    return res.json({ message: 'تم تسجيل الدخول بنجاح', token });
  } catch (error) {
    console.error('❌ حدث خطأ أثناء تسجيل الدخول:', error);
    return res.status(500).json({ message: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

module.exports = router;
