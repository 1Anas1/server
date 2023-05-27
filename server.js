var express = require('express');
var app = express();
const cors = require('cors');
var mongoose = require('mongoose');
var User =require('./models/User');
var UserSocket =require('./models/UserSocket');
const path = require('path');
const multer = require('multer');
const http = require('http');
const {Server} = require('socket.io'); 
const jwt = require('jsonwebtoken');

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req,file,cb)=>{
    console.log(file.fieldname)
    ext=path.extname(file.originalname);
    return cb(null,`${file.fieldname}_${Date.now()}${ext}`);
  }
})
const upload = multer({ storage:storage });


const bodyParser  = require('body-parser');
const userController = require('./controllers/user');
const professionalRoutes = require('./routes/professional');
const checkoutRoute = require('./routes/checkout');
const authMember = require('./middleware/memberAuth');
const authMemberChild = require('./middleware/memberAndChild');
const adminMiddleware = require('./middleware/adminMiddleware');
const createAdmin = require('./controllers/createAdmin');



// Configure CORS
app.use(cors());
const server = http.createServer(app);
const io = new Server(server)
//Routes

app.use(bodyParser.json({limit: '50mb'}));

app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use("/uploads",express.static("uploads"));
// Add professional routes
app.use('/api/professional', professionalRoutes);
app.use('/checkout', checkoutRoute(io));
app.post('/logout', userController.logout);
app.post('/verifyEmailExists',userController.verifyEmailExists);
app.post('/signupMember', userController.SignupMember);
app.post('/stati', userController.getAmountByCategory);
app.post('/transfer', authMemberChild,userController.transfer);
app.post('/bloquerbracelet', authMemberChild,(req, res) => {
  userController.bloquerbracelet(req,res,io)
});
app.post('/deletechild', userController.removeChildAndTransferBraceletAmount);
app.post('/signinMember',(req, res) => { 
  userController.signinMember(req, res,io)
});
app.get('/GetAllInfoUser',authMember,userController.GetAllInfoUser)
app.post('/createBracelet',userController.createBracelet)
app.post('/addAmount',authMember, (req, res) => {
  userController.addAmount(req, res, io);
})
app.post('/childSignup',authMember, userController.childSignup);
app.post('/SignupMember',userController.SignupMember);
app.post('/adminLogin', userController.adminLogin);

app.post('/pro/signup', userController.proSignup);

app.get('/', function (req, res) {
  res.send('Hello World!');
});
app.get('/get', function (req, res) {
  res.send('Hello World!');
});




//---------------------------------socket---------------------------------------------------------------/
io.on('connection', (socket) => {
  
  // When a user logs in or connects
  socket.on('login', async (token) => {
    let error = false; // Declare error as a regular variable
  
    try {
      console.log('temchy socket',token);
      //const extractedToken = token.split(' ')[1];
      console.log(process.env.JWT_SECRET)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      const userRole = decoded.role;
      console.log(userRole,userId)
       // Make sure req object is available
  
      // Store the mapping in the database
      const userSocket = new UserSocket({
        userId,
        socketId: socket.id,
      });
      console.log(socket.id);
      await userSocket.save(); // Use await to wait for the save operation to complete
  
      const user = await User.findById(userId)
        .populate('role')
        .populate({
          path: 'children',
          populate: { path: 'bracelets' },
        })
        .populate({
          path: 'bracelets',
          populate: {
            path: 'operations',
            populate: [
              { path: 'sellingPoint' },
              { path: 'operationLines', populate: { path: 'product', select: 'name' } },
            ],
          },
        })
        .exec();
  
      io.to(userSocket.socketId).emit('user_info', user, error);
    } catch (e) {
      error = true;
      console.error(e);
      io.to(socket.id).emit('user_info', null, error); // Emit error to the socket
    }
  });
  // When a user disconnects
  socket.on('disconnect', async () => {
    // Remove the mapping from the database
    console.log('deconnecter');
    await UserSocket.findOneAndDelete({ socketId: socket.id });
  });

  //------------
  socket.on('get_user_info', async (data) => {
    try {
      console.log("temchy getuser",data)
      const user = await User.findById(userId)
        .populate('role')
        .populate({
          path: 'children',
          populate: { path: 'bracelets' },
        })
        .populate({
          path: 'bracelets',
          populate: {
            path: 'operations',
            populate: [
              { path: 'sellingPoint' },
              { path: 'operationLines', populate: { path: 'product', select: 'name' } },
            ],
          },
        })
        .exec();
        console.log("hhh",user.children)

      // Emit the user information back to the client
      socket.emit('user_info', user);
    } catch (error) {
      console.error(error);
      // Handle the error case and emit an error event if needed
    }
  });
});
//------------------------------------------------------------------------------------------------/

mongoose.set("strictQuery", false)
mongoose.connect('mongodb+srv://anass:root@cluster0.s4lmegp.mongodb.net/test?retryWrites=true&w=majority', {useNewUrlParser: true,useUnifiedTopology: true})
.then((result)=>server.listen(8003, function () {createAdmin();console.log('Listening to Port 8000')}))
.catch((err)=>console.log('Error', err));
