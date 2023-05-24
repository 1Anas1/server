const mongoose = require('mongoose');

const userSocketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  socketId: {
    type: String,
    required: true,
  },
});

const UserSocket = mongoose.model('UserSocket', userSocketSchema);

module.exports = UserSocket;