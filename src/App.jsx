import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { GuestOnly, HomeRedirect, RequireRole } from './routes/guards.jsx';
import { PageSkeleton } from './components/ui/Feedback.jsx';
import { FloatingCalculator } from './components/Calculator.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import StaffLayout from './layouts/StaffLayout.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import NotFound from './pages/NotFound.jsx';
import Profile from './pages/Profile.jsx';

// Staff pages: bundled eagerly (not lazy), not split into separate chunks — a staff member who's
// offline must be able to navigate to any of these without a network round trip to fetch its JS.
import StaffHome from './pages/staff/Home.jsx';
import NewSale from './pages/staff/NewSale.jsx';
import SaleComplete from './pages/staff/SaleComplete.jsx';
import MySales from './pages/staff/MySales.jsx';
import MySale from './pages/staff/MySale.jsx';
import StaffInventory from './pages/staff/StaffInventory.jsx';

// Admin pages
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Products = lazy(() => import('./pages/admin/Products.jsx'));
const ProductForm = lazy(() => import('./pages/admin/ProductForm.jsx'));
const ProductDetail = lazy(() => import('./pages/admin/ProductDetail.jsx'));
const Inventory = lazy(() => import('./pages/admin/Inventory.jsx'));
const InventoryDetail = lazy(() => import('./pages/admin/InventoryDetail.jsx'));
const Transfers = lazy(() => import('./pages/admin/Transfers.jsx'));
const Sales = lazy(() => import('./pages/admin/Sales.jsx'));
const SaleDetail = lazy(() => import('./pages/admin/SaleDetail.jsx'));
const Suppliers = lazy(() => import('./pages/admin/Suppliers.jsx'));
const SupplierDetail = lazy(() => import('./pages/admin/SupplierDetail.jsx'));
const Customers = lazy(() => import('./pages/admin/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/admin/CustomerDetail.jsx'));
const Staff = lazy(() => import('./pages/admin/Staff.jsx'));
const StaffDetail = lazy(() => import('./pages/admin/StaffDetail.jsx'));
const Reports = lazy(() => import('./pages/admin/Reports.jsx'));
const ActivityPage = lazy(() => import('./pages/admin/Activity.jsx'));
const Settings = lazy(() => import('./pages/admin/Settings.jsx'));

const page = (el) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
              <Route path="/signup/:token" element={<GuestOnly><Signup /></GuestOnly>} />

              <Route element={<RequireRole roles={['ADMIN']} />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<HomeRedirect />} />
                  <Route path="dashboard" element={page(<Dashboard />)} />
                  <Route path="products" element={page(<Products />)} />
                  <Route path="products/new" element={page(<ProductForm />)} />
                  <Route path="products/:id" element={page(<ProductDetail />)} />
                  <Route path="products/:id/edit" element={page(<ProductForm />)} />
                  <Route path="inventory" element={page(<Inventory />)} />
                  <Route path="inventory/:id" element={page(<InventoryDetail />)} />
                  <Route path="transfers" element={page(<Transfers />)} />
                  <Route path="sales" element={page(<Sales />)} />
                  <Route path="sales/:id" element={page(<SaleDetail />)} />
                  <Route path="suppliers" element={page(<Suppliers />)} />
                  <Route path="suppliers/:id" element={page(<SupplierDetail />)} />
                  <Route path="customers" element={page(<Customers />)} />
                  <Route path="customers/:id" element={page(<CustomerDetail />)} />
                  <Route path="staff" element={page(<Staff />)} />
                  <Route path="staff/:id" element={page(<StaffDetail />)} />
                  <Route path="reports" element={page(<Reports />)} />
                  <Route path="activity" element={page(<ActivityPage />)} />
                  <Route path="settings" element={page(<Settings />)} />
                  <Route path="profile" element={page(<Profile />)} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>

              <Route element={<RequireRole roles={['STAFF']} />}>
                <Route path="/staff" element={<StaffLayout />}>
                  <Route index element={<HomeRedirect />} />
                  <Route path="home" element={<StaffHome />} />
                  <Route path="sale" element={<NewSale />} />
                  <Route path="sale/complete/:id" element={<SaleComplete />} />
                  <Route path="sales" element={<MySales />} />
                  <Route path="sales/:id" element={<MySale />} />
                  <Route path="inventory" element={<StaffInventory />} />
                  <Route path="profile" element={<Profile staff />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingCalculator />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
