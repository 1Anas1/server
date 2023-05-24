const Role = require('../models/Role');
const User = require('../models/User');
const bcrypt = require('bcrypt');

const createAdmin = async () => {
  try {
    // Check if admin role exists, create it if not
    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
      const newAdminRole = new Role({
        name: 'admin'
      });
      await newAdminRole.save();
      adminRole = await Role.findOne({ name: 'admin' });
      console.log('Admin role created');
    }
    
    const hashedPassword = await bcrypt.hash('admin', 10);
    // Check if admin user exists, create it if not
    const adminUser = await User.findOne({ role: adminRole });
    if (!adminUser) {
      const newAdminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        phone: '555-555-5555',
        image: 'default.png',
        status: 'active',
        role: adminRole
      });
      await newAdminUser.save();
      console.log('Admin user created');
    }
  } catch (err) {
    console.error(err);
  }
};

module.exports = createAdmin;