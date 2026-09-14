export interface TopCustomer {
  customer_id: number;
  full_name: string;
  total_amount: string;
  order_count: number;
  average_ticket: string;
}

export interface TopCustomersResponse {
  as_of: string;
  data: TopCustomer[];
}
