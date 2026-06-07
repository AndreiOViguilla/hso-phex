const mongoose = require("mongoose");

const formSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  formType: { type: String, enum: ["mef", "def"], required: true },
  formData: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

formSchema.index({ userId: 1, formType: 1 }, { unique: true });

module.exports = mongoose.model("Form", formSchema);
