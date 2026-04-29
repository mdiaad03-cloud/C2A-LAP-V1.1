import axios from "axios";

const storeApi = axios.create({
  baseURL: "/api/store",
  timeout: 20000,
});

export default storeApi;
