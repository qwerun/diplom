import { BookOpen, FolderKanban, Gauge, LogOut, Megaphone, Users } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import api, { logout } from "../api/client";
import { CAN_VIEW_REPORTS, ROLES } from "../utils/roles";

const menu = [
  { to: "/", label: "Панель", icon: Gauge },
  { to: "/campaigns", label: "Кампании", icon: Megaphone },
  { to: "/reports", label: "Отчеты", icon: BookOpen, roles: CAN_VIEW_REPORTS },
  { to: "/users", label: "Пользователи", icon: Users, adminOnly: true },
  { to: "/dictionaries", label: "Справочники", icon: FolderKanban, adminOnly: true },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);

  const role = currentUser?.profile?.role;
  const isAdmin = role === ROLES.ADMIN;
  const visibleMenu = useMemo(() => menu.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.roles && !item.roles.includes(role)) return false;
    return true;
  }), [isAdmin, role]);

  useEffect(() => {
    api.get("/me/").then((res) => setCurrentUser(res.data)).catch(() => {
      logout();
      navigate("/login");
    });
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    const adminPathDenied = !isAdmin && ["/users", "/dictionaries"].some((path) => location.pathname.startsWith(path));
    const reportsDenied = !CAN_VIEW_REPORTS.includes(role) && location.pathname.startsWith("/reports");
    if (adminPathDenied || reportsDenied) {
      navigate("/", { replace: true });
    }
  }, [currentUser, isAdmin, role, location.pathname, navigate]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="main-header">
          <a className="brand" href="/">
            <img className="brand-logo-image" src="/logo-muiv.svg" alt="Московский университет имени С.Ю. Витте" />
            <span>
              <strong>Управление рекламными кампаниями</strong>
            </span>
          </a>
          <nav className="top-nav">
            {visibleMenu.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <button className="logout-button" onClick={handleLogout} title="Выйти">
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </header>
      <main>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
