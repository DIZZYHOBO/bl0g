import Layout from '../components/Layout';
import LemmyLogin from '../components/LemmyLogin';
import SEO from '../components/SEO';
import { getGlobalData } from '../utils/global-data';

export default function Login({ globalData }) {
  return (
    <Layout>
      <SEO title={`Login - ${globalData.name}`} description="Login with your Lemmy account" />
      <div className="max-w-md mx-auto mt-20">
        <LemmyLogin />
      </div>
    </Layout>
  );
}

export function getStaticProps() {
  const globalData = getGlobalData();
  return { props: { globalData } };
}
