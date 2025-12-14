import { useState } from "react";

export function useAuth() {
    const [token, setToken] = useState(() => {
        return localStorage.getItem("token");
    });

    const [isAdmin, setIsAdmin] = useState(() => {
        return localStorage.getItem("is_admin") === "true";
    });

    function login(token, isAdmin) {
        localStorage.setItem("token", token);
        localStorage.setItem("is_admin", isAdmin);
        setToken(token);
        setIsAdmin(isAdmin);
    }

    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("is_admin");
        setToken(null);
        setIsAdmin(false);
    }

    return {
        token,
        isAdmin,
        isAuthenticated: !!token,
        login,
        logout,
    };
}
