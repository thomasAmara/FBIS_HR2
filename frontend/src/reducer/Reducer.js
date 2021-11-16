import  { actionType } from "./ActionType";

const {
    LOGIN_USER,
    LOGIN_ERROR,
    LOGIN_SUCCESS,
    CHANGE_PASSWORD,
    CHANGE_PASSWORD_SUCCESS,
    CHANGE_PASSWORD_ERROR,
    LOGOUT_USER
} = actionType;


const initialState = {
    isLogged:false,
    userData:{},
    userDataInput:{},
    isError:false,
    loading:false,
}


export const LoginReducer = (state= initialState, { type, payload }) => {
    switch (type) {
        case LOGIN_USER: 
            return {
                 ...state,
                 userDataInput: payload, 
                 loading: true,
                 isLogged: false, 
                };
        case LOGIN_SUCCESS:
            return { 
                ...state,
                userDataInput: {},
                userData: payload, 
                isLogged: true, 
                loading:false,  
                loginError: {}
            };
        case LOGIN_ERROR : 
            return { 
                ...state,
                isLogged:false, 
                loading: false, 
                loginError: payload, 
                key: null 
            };

        case CHANGE_PASSWORD:
            return { ...state, loading: true, change:false}

        case CHANGE_PASSWORD_ERROR:
            return { ...state, loading: false, change:false}

        case CHANGE_PASSWORD_SUCCESS:
            return { ...state, loading: false, change:true}

        case LOGOUT_USER:
                return {
                  ...state,
                  isLogged: false,
                  userData: {},
                  userDataInput: {},
                  isError: false,
                  recovered: false,
                  loading: false,
                };
        default: 
            return state
    }
    
}