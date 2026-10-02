import LoginPage from "../../views/pages/login";

type LoginRouteProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const params = searchParams ? await searchParams : {};

  return <LoginPage error={params.error} nextPath={params.next} />;
}
