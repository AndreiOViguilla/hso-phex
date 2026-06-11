import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { getSchedule } from "./utils/schedule";
import LoginPage        from "./pages/LoginPage";
import HomePage         from "./pages/HomePage";
import SchedulePage     from "./pages/SchedulePage";
import BookingGuidePage from "./pages/BookingGuidePage";
import MEFPage          from "./pages/MEFPage";
import BookingPage      from "./pages/BookingPage";
import DEFPage          from "./pages/DEFPage";
import SuccessPage      from "./pages/SuccessPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import ProfilePage        from "./pages/ProfilePage";
import ResetPasswordPage  from "./pages/ResetPasswordPage";
import AdminDashboard     from "./pages/AdminDashboard";
import { ThemeProvider } from "./ThemeContext";
import { ModalProvider } from "./components/Modal";

export function getAuthHeader() { return {}; }

function RequireAuth({ userData, authLoading, children }) {
  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "#f0f2f5" }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
      </svg>
      <div style={{ fontSize: 13, color: "#6b7280", fontFamily: "'DM Sans',sans-serif" }}>Verifying session…</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  if (!userData) return <Navigate to="/unauthorized" replace />;
  return children;
}

function AppInner() {
  const navigate = useNavigate();
  const [studentId,    setStudentId]    = useState("");
  const [sched,        setSched]        = useState(null);
  const [bookActivity, setBookActivity] = useState("phex");
  const [phexBooking,  setPhexBooking]  = useState(null);
  const [dtBooking,    setDtBooking]    = useState(null);
  const [userData,     setUserData]     = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    // Only attempt restore if we have a session hint flag
    if (!sessionStorage.getItem("hasSession")) { setAuthLoading(false); return; }

    const init = async () => {
      try {
        const [userResp, bookingsResp] = await Promise.all([
          fetch("/api/students/me", { credentials: "include" }),
          fetch("/api/appointments/mine", { credentials: "include" }),
        ]);

        if (userResp.ok) {
          const user = await userResp.json();
          setUserData(user);
          setStudentId(user.studentId);
          setSched(getSchedule(user.studentId));
        } else {
          sessionStorage.removeItem("hasSession");

        }

        if (bookingsResp.ok) {
          const bookings = await bookingsResp.json();
          bookings.forEach(b => {
            const booking = { date: b.appointmentDate, time: b.timeSlot, code: b.bookingCode };
            if (b.appointmentType === "phex") setPhexBooking(booking);
            if (b.appointmentType === "dt")   setDtBooking(booking);
          });
        }
      } catch (_) {}
      setAuthLoading(false);
    };
    init();
  }, []);

  const handleLogin = async (id, user) => {
    sessionStorage.setItem("hasSession", "1");
    setUserData(user);
    setStudentId(id);
    if (user.role === "admin" || user.role === "master" || user.role === "nurse") {
      navigate("/admin");
      return;
    }
    setPhexBooking(null);
    setDtBooking(null);
    try {
      const bookings = await fetch("/api/appointments/mine", { credentials: "include" }).then(r => r.json());
      bookings.forEach(b => {
        const booking = { date: b.appointmentDate, time: b.timeSlot, code: b.bookingCode };
        if (b.appointmentType === "phex") setPhexBooking(booking);
        if (b.appointmentType === "dt")   setDtBooking(booking);
      });
    } catch (_) {}
    const s = getSchedule(id);
    if (s) { setSched(s); navigate("/schedule"); }
    else navigate("/");
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("hasSession");
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch (_) {}
    setAuthLoading(true);
    setStudentId(""); setSched(null);
    setPhexBooking(null); setDtBooking(null); setUserData(null);
    navigate("/", { replace: true });
    setTimeout(() => setAuthLoading(false), 200);
  };

  const openBooking = (activity) => { setBookActivity(activity); navigate("/booking"); };

  return (
    <div style={{ fontFamily: "'DM Sans','Inter',sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Routes>
        <Route path="/" element={<HomePage onLogin={() => navigate("/login")} onGuide={() => navigate("/guide")} />} />
        <Route path="/login" element={<LoginPage onBack={() => navigate("/")} onLogin={handleLogin} />} />
        <Route path="/guide" element={<BookingGuidePage onBack={() => navigate(-1)} />} />
        <Route path="/unauthorized" element={<UnauthorizedPage onBack={() => navigate("/")} />} />
        <Route path="/schedule" element={<RequireAuth userData={userData} authLoading={authLoading}><SchedulePage studentId={studentId} sched={sched} onBack={() => navigate("/")} onGuide={() => navigate("/guide")} onMEF={() => navigate("/mef")} onBookPHEx={() => openBooking("phex")} onBookDT={() => openBooking("dt")} onDEF={() => navigate("/def")} phexBooking={phexBooking} dtBooking={dtBooking} onLogout={handleLogout} onProfile={() => navigate("/profile")} userData={userData} /></RequireAuth>} />
        <Route path="/booking" element={<RequireAuth userData={userData} authLoading={authLoading}><BookingPage activity={bookActivity} studentId={studentId} prefillFirstName={userData?.firstName || ""} prefillLastName={userData?.lastName || ""} prefillEmail={userData?.email || ""} onBack={() => navigate("/schedule")} onBooked={(booking) => { if (bookActivity === "phex") setPhexBooking(booking); else setDtBooking(booking); navigate("/schedule"); }} /></RequireAuth>} />
        <Route path="/mef" element={<RequireAuth userData={userData} authLoading={authLoading}><MEFPage prefillId={studentId} prefillFirstName={userData?.firstName || ""} prefillLastName={userData?.lastName || ""} prefillMI={userData?.middleInitial || ""} prefillGender={userData?.gender || ""} onBack={() => navigate("/schedule")} onSuccess={async () => {
                  await fetch("/api/students/me/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ filledMEF: true }) });
                  navigate("/schedule");
                }} /></RequireAuth>} />
        <Route path="/def" element={<RequireAuth userData={userData} authLoading={authLoading}><DEFPage prefillId={studentId} prefillName={userData ? [userData.firstName, userData.middleInitial, userData.lastName].filter(Boolean).join(" ") : ""} onBack={() => navigate("/schedule")} onSuccess={async () => {
                  await fetch("/api/students/me/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ filledDEF: true }) });
                  navigate("/schedule");
                }} /></RequireAuth>} />
        <Route path="/success" element={<RequireAuth userData={userData} authLoading={authLoading}><SuccessPage onHome={() => navigate("/schedule")} /></RequireAuth>} />
        <Route path="/profile" element={
          <RequireAuth userData={userData} authLoading={authLoading}>
            <ProfilePage userData={userData} onBack={() => navigate("/schedule")} onSaved={(updated) => { setUserData(updated); setStudentId(updated.studentId); setSched(getSchedule(updated.studentId)); }} />
          </RequireAuth>
        } />
        <Route path="/reset-password" element={
          <ResetPasswordPage onBack={() => navigate("/login")} />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={
            <RequireAuth userData={userData} authLoading={authLoading}>
              {userData?.role === "student"
                ? <Navigate to="/schedule" replace />
                : <AdminDashboard userData={userData} onLogout={handleLogout} onBack={() => navigate("/")} />
              }
            </RequireAuth>
          } />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ModalProvider>
        <BrowserRouter><AppInner /></BrowserRouter>
      </ModalProvider>
    </ThemeProvider>
  );
}