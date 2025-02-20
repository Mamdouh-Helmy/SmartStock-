const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// منع إعادة تشفير كلمة المرور إذا كانت مشفرة بالفعل
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  // التحقق مما إذا كانت كلمة المرور مشفرة بالفعل
  const isHashed = this.password.startsWith('$2a$10$');
  if (isHashed) {
    console.log('⚠️ كلمة المرور مشفرة بالفعل، لن يتم تشفيرها مرة أخرى.');
    return next();
  }

  console.log('🔹 يتم تشفير كلمة المرور لأول مرة:', this.password);
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
