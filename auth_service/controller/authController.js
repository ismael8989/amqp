const User = require('../model/User');
const jwt = require('jsonwebtoken');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
  
  return { accessToken, refreshToken, refreshTokenExpiry };
};

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email or username already exists' 
      });
    }
    
    const newUser = new User({
      username,
      email,
      password,
    });
    
    await newUser.save();
    
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens(newUser._id);
    
    newUser.refreshTokens.push({
      token: refreshToken,
      expiresAt: refreshTokenExpiry
    });
    
    await newUser.save();
    
    if (req.channel) {
      req.channel.publish(
        'auth_events',
        'user.created',
        Buffer.from(JSON.stringify({
          userId: newUser._id,
          username: newUser.username,
          email: newUser.email,
          createdAt: newUser.createdAt
        }))
      );
    }
    
    res.status(201).json({
      success: true,
      user: newUser,
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens(user._id);
    
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: refreshTokenExpiry
    });
    
    await user.save();
    
    if (req.channel) {
      req.channel.publish(
        'auth_events',
        'user.login',
        Buffer.from(JSON.stringify({
          userId: user._id,
          username: user.username,
          timestamp: new Date()
        }))
      );
    }
    
    res.status(200).json({
      success: true,
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const { userId } = req.user;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.refreshTokens = user.refreshTokens.filter(
      token => token.token !== refreshToken
    );
    
    await user.save();
    
    if (req.channel) {
      req.channel.publish(
        'auth_events',
        'user.logout',
        Buffer.from(JSON.stringify({
          userId: user._id,
          username: user.username,
          timestamp: new Date()
        }))
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};

exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const tokenExists = user.refreshTokens.find(token => 
      token.token === refreshToken && token.expiresAt > new Date()
    );
    
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked or expired'
      });
    }
    
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: error.message
    });
  }
};