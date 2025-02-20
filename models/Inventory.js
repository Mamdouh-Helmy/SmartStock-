const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productName: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  totalValue: { type: Number, required: true },
  year: { type: Number, required: true },
});

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
