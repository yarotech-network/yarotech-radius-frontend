import { Link } from 'react-router';
import { AuthSplitLayout } from '@/app/shell/AuthSplitLayout';
import { Alert } from '@/components/feedback';

export default function AcceptInvitationPage() {
  return <AuthSplitLayout title="Invitation link retired" footer={<Link to="/login" className="text-brand-600">Back to sign in</Link>}>
    <Alert tone="warning">Account officers are now created by a platform administrator. Ask your administrator to create your account and send a new setup email.</Alert>
  </AuthSplitLayout>;
}
