import { createHashHistory, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultErrorComponent } from "./components/ErrorScreen";

export const getRouter = () => {
  const history =
    typeof window === "undefined"
      ? createMemoryHistory({
          initialEntries: ["/"],
        })
      : createHashHistory();

  const router = createRouter({
    routeTree,
    history,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
