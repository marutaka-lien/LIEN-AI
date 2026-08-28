export interface RunRakutenClickPostOptions {
  // RMSの「注文確認」ボタンを実際にクリックするか。falseの場合はドライラン扱いで
  // クリックせず、注文確認が必要な旨のみステップに記録する。
  rmsConfirmExecute?: boolean;
  // ClickPostへの実登録(CSVアップロード・決済・ラベル取得)を実行するか。
  // ClickPostServiceが未実装のため、現時点ではtrueを指定しても
  // ClickPostNotImplementedErrorになりJobItemはfailedとして記録される。
  clickPostExecute?: boolean;
  // 指定された場合、RMSから取得した対象注文のうちここに含まれるorderNumberのみを処理する
  // (発送エントリー画面で「選択した注文者のみ処理」した場合に使用)。未指定または空配列の場合は
  // 取得した全件を処理する(従来どおりの挙動)。
  orderNumbers?: string[];
}
