const User = require ('../models/userModel')
const jwt = require ('jsonwebtoken')
const { promisify } = require('util')
const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')
const sendEmail = require('../utils/email')
const crypto = require('crypto')

const signToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {
        expiresIn: '3d'
    })
}

exports.signup = catchAsync( async(req, res, next) => {
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
        token,
        data: {
            user: newUser
        }
    })
    
})

exports.login = catchAsync( async(req, res, next) => {
    const {email, password} = req.body

    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400))
    }

    const user = await User.findOne({email}.select('+password'))

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next ( new AppError('Incorrect email or Password', 401))
    }

    const token = signToke(user._id)
    res.status(200).json({
        status: 'success',
        token
    })
})

exports.protect = catchAsync( async (req, res, next) => {
    let token 
    if (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer'))
    {
        token = req.headers.authorization.split(' ')[1]
    }
    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access', 401))
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

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

    const token = signToken(user._id)
    res.status(200).json({
        status: 'success', 
        token 
    })

})

exports.updatePassword = catchAsync ( async (req, res, next) => {
        const user = await User.findById(req.user._id).select('+password')

        if(!(await user.correctPassword(req.body.passwordCurrent, user.password))){
            return next(new AppError('Your current password is wrong', 401))
        }

        user.password = req.body.password
        user.passwordConfirm = req.body.passwordConfirm
        await user.save()

        const token = signToken(user._id)
        res.status(200).json({
            status:'success',
            token,
            data: {
                user
            }
        })
})