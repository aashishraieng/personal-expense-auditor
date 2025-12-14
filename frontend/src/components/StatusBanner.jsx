export default function StatusBanner({ message, type = "success", onClose }) {
    if (!message) return null;

    const base =
        "fixed top-5 right-5 px-5 py-3 rounded-lg shadow-lg text-sm z-50 transition";

    const styles =
        type === "error"
            ? "bg-red-500/20 text-red-300 border border-red-500/30"
            : "bg-green-500/20 text-green-300 border border-green-500/30";

    return (
        <div className={`${base} ${styles}`}>
            <div className="flex items-center gap-3">
                <span>{message}</span>
                <button
                    onClick={onClose}
                    className="text-xs opacity-70 hover:opacity-100"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
