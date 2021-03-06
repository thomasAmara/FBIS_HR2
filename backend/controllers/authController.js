const User = require ('../models/userModel')
const jwt = require ('jsonwebtoken')
const { promisify } = require('util')
const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')
const sendEmail = require('../utils/email')
const crypto = require('crypto')
const asyncHandler = require('express-async-handler') 

const signToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {
        expiresIn: '72h'
    })
}

const createSendToken = ( user, statusCode, res) => {
    const token = signToken(user._id)

    const cookieOptions = { 
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 100),
        httpOnly: true
    }
    if ( process.env.NODE_ENV === 'production') cookieOptions.secure = true
    //Cookies
    res.cookie('jwt', token, cookieOptions)

    user.password = undefined

    res.status(statusCode).json({
        status: 'success',
        access_token:token,
        message: 'success',
        success: true,
        data: {
            user,  
        }
    })
}

exports.signup = asyncHandler( async(req, res, next) => {
    // const newUser = await User.create(req.body)
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        // passwordChangedAt:req.body.passwordChangedAt,
        // role: req.body.role
    })

    const token = signToken(newUser._id)

    res.status(201).json({
        status:'success',
        message: 'success',
        success: true,
        token,
        data: {
            user: newUser
        }
    })
    
})


exports.login = catchAsync( async(req, res, next) => {
    // console.log(req.body)
    // console.log(JSON.stringify (req.body))
    const { email, password } = req.body;
   
    if (!email || !password) {
        return next( new AppError('Please provide email and password', 400))
    }

    const user = await User.findOne({ email }).select('+password')

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next ( new AppError('Incorrect email or Password', 401))
    }

    // const token = signToken(user._id)
    // res.status(200).json({
    //     status: 'success',
    //     message: 'Success',
    //     data:{
    //         access_token:token,
    //         name:user.name,
    //         email:user.email,
    //         role: user.role,
           
    //         // user
    //     }, 
    //     success: true,
    // })

    createSendToken(user, 200, res)
})

exports.protect = catchAsync( async (req, res, next) => {
    let access_token 
    if (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer'))
       
        {
            access_token = req.headers.authorization.split(' ')[1]
        }

        if (!access_token) {
            return next(new AppError('You are not logged in! Please log in to get access', 401))
        }
    console.log('this token is', access_token)
    const decoded = await promisify(jwt.verify)(access_token, process.env.JWT_SECRET)

    const currentUser = await User.findById(decoded.id)
    if (!currentUser) {
        return next(
            new AppError('The user belonging to this token does not exist', 401)
        )
    }

    if(currentUser.changedPasswordAfter(decoded.iat)){
        return next(new AppError('User recently changed password! Please log in again.', 401))
    }

    req.user = currentUser
    next()
})

exports.forgotPassword = catchAsync( async (req, res, next)=> {
    const user = await User.findOne({ email: req.body.email})
    if (!user){
        return next(new AppError('There is no user with email Address', 404))
    }

    const resetToken = user.createPasswordResetToken()
    await user.save({ validateBeforeSave: false })

    const resetURL = `${req.protocol}://${req.get(
        'host'
        )}/api/v1/users/resetPassword/${resetToken}`

        const message = `Forgot your password ? Submit a PATCCH request with your new password and
        password coonfirm to ${resetURL}.\nIf you didnt forget your password, please ignore this
         email `

         try {
             await sendEmail({
                 email: user.email,
                 subject: 'Your password reset token (Valid for 20 minutes)',
                 message
             })
             res.status(200).json({
                status: 'success',
                message: 'Token sent to email'
            })
         } catch (error) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false});

            return next(
                new AppError('There was an error sending the email. Try again later!'), 
                500
            )
         }
})

exports.resetPassword = catchAsync(async(req, res, next) => {
    const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex')

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    })

    if(!user) {
        return next( new AppError('Token is invalid or has expires', 400))
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // const token = signToken(user._id)
    // res.status(200).json({
    //     status: 'success', 
    //     token 
    // })
    createSendToken(user, 200, res)

})

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)){
            return next(
                new AppError ('You do not have permission to perform this action', 403)
            )
        }
        next()
    }
}

exports.updatePassword = catchAsync ( async (req, res, next) => {
        const user = await User.findById(req.user._id).select('+password')

        if(!(await user.correctPassword(req.body.passwordCurrent, user.password))){
            return next(new AppError('Your current password is wrong', 401))
        }

        user.password = req.body.password
        user.passwordConfirm = req.body.passwordConfirm
        await user.save()

        createSendToken(user, 200, res)
})