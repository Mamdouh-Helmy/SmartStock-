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
    if (!passwordMatch) {
      return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
    }

    // تحديد مدة انتهاء التوكن (15 يومًا)
    // const expiresIn = 15 * 24 * 60 * 60; 
    // const expirationDate = Date.now() + expiresIn * 1000; 

    const expiresIn = 60; // 60 ثانية = 1 دقيقة
const expirationDate = Date.now() + expiresIn * 1000; 

    // توليد التوكن مع تاريخ انتهاء الصلاحية
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '15d' });

    return res.json({ 
      message: 'تم تسجيل الدخول بنجاح', 
      token, 
      expiresAt: expirationDate 
    });

  } catch (error) {
    console.error('❌ حدث خطأ أثناء تسجيل الدخول:', error);
    return res.status(500).json({ message: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

module.exports = router;

