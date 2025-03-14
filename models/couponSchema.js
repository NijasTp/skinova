const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  createdOn: {
    type: Date,
    default: Date.now
  },
  startDate:{
    type: Date,
    required: true
  },
  expireOn: {
    type: Date,
    required: true
  },
  offerPrice: {
    type: Number,
    required: true
  },
  minimumPrice: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageLimit: {
    type: Number, 
    default: 1
  },
  usedBy: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timesUsed: { type: Number, default: 0 }
    }
  ]
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
