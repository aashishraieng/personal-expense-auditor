import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(
        !!localStorage.getItem("token")
    );
    const [isAdmin, setIsAdmin] = useState(
        localStorage.getItem("is_admin") === "true"
    );

    function login(data) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("is_admin", data.is_admin ? "true" : "false");
        setIsAuthenticated(true);
        setIsAdmin(!!data.is_admin);
    }

    function logout() {
        localStorage.clear();
        setIsAuthenticated(false);
        setIsAdmin(false);
    }

    return (
        <AuthContext.Provider
            value={{ isAuthenticated, isAdmin, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
