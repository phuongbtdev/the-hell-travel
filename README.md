# 18 Tầng Địa Ngục — web 3D

Prototype web nhiều người chơi dùng Three.js và Colyseus. Mỹ thuật theo các concept sheet trong `public/assets/concept`. Bộ 15 nhân vật gồm các hồn ma, lữ hành nam/nữ, Tiểu Sai, Diêm Vương, thư lại, ba quỷ sai, người chịu phạt, chó ngao và trâu quỷ. Mỗi model có rig và 18 animation clip, dựng bằng script theo ảnh tham chiếu.

Mở `/character-review.html` để chọn một trong 15 nhân vật, xoay model, đổi chuyển động và tải GLB. Không cần ứng dụng dựng hình bên ngoài.

## Hành trình

1. Vào game, đi tới quầy bên trái đường đá và nhấn `E` để ghi danh.
2. Đi thẳng đến điện phía sau cổng, hoặc bấm **Chính điện** phía trên.
3. Tiếp cận Diêm Vương để đối thoại, hoặc chọn một trong 18 cổng ở hai bên điện.
4. Mở **Bản đồ 18 tầng** để đi tự do. Mỗi tầng có cảnh vật, vòng chuyển động hài, âm thanh nền và cổng quay lại/đi tiếp.
5. Bấm **Đọc chuyện tội và phạt** để xem lời dẫn và đối đáp. Ở Chính Điện, bấm **Xem Diêm Vương phán**; lời phán thay đổi khi đã đi đủ 18 tầng. Phụ đề chữ lớn nằm dưới màn hình, tự chia đoạn ngắn; dùng **Tiếp tục**, phím cách, nút quay lại hoặc đóng để đọc theo nhịp riêng.
6. Mỗi tầng có video diễn cận cảnh dùng cùng mô hình và hoạt cảnh 3D. Có thể phóng to video bằng nút mũi tên.
7. Nút vàng **Trải nghiệm hình phạt**, phía trên nút đọc chuyện, gọi một quỷ sai tới bắt và áp giải hồn ma của bạn vào vị trí thi hành. Nhân vật người chơi thay cho người chịu phạt trong màn diễn 12–16 giây tùy tầng, sau đó được đưa trở ra. Dùng **Dừng · Esc** để hủy ở bất kỳ bước nào. Di chuyển, góc máy và animation được điều khiển theo màn diễn trong lúc tham gia.

Mỗi tầng có cấu hình riêng tại `src/world/experience-profiles.ts`: đường bàn giao, góc máy, ba nhịp thi hành và âm phản ứng. Đồng hồ đạo cụ và animation khởi động cùng màn trải nghiệm; người xem cùng tầng nhận cả thời gian màn diễn để đạo cụ và người chơi đi cùng nhịp. Tầng Kéo Cắt dùng hai bộ kéo cầm tay, tách các mảnh hồn bằng rig rồi ghép lại; hiệu ứng không dùng vết thương. Các ảnh kiểm tra model người chơi trong từng án nằm tại `public/assets/experience/`.

Mỗi tầng có một điểm trải nghiệm. Khi có nhiều người, server xếp hàng và gọi người tiếp theo sau khi điểm thi hành được trả; người đang chờ vẫn có thể đi lại. Đổi tầng/hủy/thoát phòng giải phóng lượt. Tư thế và animation người tham gia được đồng bộ cho người cùng khu vực.

Tầng 4 **Lột Mặt Nạ** thay cho Gương Nghiệp: ba lớp mặt nạ cong có hốc mắt và nét mặt nổi được bóc khỏi mặt, chuyển qua tay quỷ sai rồi rơi vào xe. Mặt nạ mới lại mọc lên, quỷ đẩy xe và người chịu phạt cùng hoảng. Màn diễn 14 giây dùng chung nhịp cho đạo cụ, người chơi và người xem; tiếng bóc, mặt nạ chạm xe khớp nhịp. Lời dẫn, đối đáp chỉ hiện phụ đề. Đạo cụ dựng trong `src/world/mask-peeling.ts`, clip cận cảnh là `public/video/floors/floor-04.mp4`.

Tầng 11 **Đá Đè** có giàn nâng và cú thả đá tăng tốc, nện trúng đầu hồn đang nằm trên bệ. Những tam giác thuộc xương đầu trong GLB được chia thành các mảnh 3D giữ nguyên tóc, mắt và màu model; đầu gốc ẩn trong lúc các mảnh văng ra rồi tự ghép lại. Chuẩn bị các mảnh trước cú nện; nhịp rơi, âm trầm, tiếng vỡ, góc cận cảnh và rung máy theo cùng đồng hồ sân khấu. Hủy hoặc đổi tầng khôi phục đầu và giải phóng hình học riêng. Hoạt cảnh ở `src/world/stone-crush.ts`, clip `floor-11.mp4` dài 12 giây.

Tầng 14 **Kéo Cổ** thay cho Oan Khuất. Quỷ quay tời kéo cổ dài tới xà, thân giãy rồi tuột xuống, đầu vẫn treo trên dây. Thả chốt thì đầu bật lại theo dao động lò xo giảm dần; quỷ cầm vợt đỡ hụt và cả thân ráp trở lại. Đầu di chuyển bằng xương `Head` của model, cổ là lưới 3D uốn cong cập nhật trên bộ nhớ có sẵn. Cảnh, âm tời/lò xo, góc máy, người trải nghiệm và người xem dùng chung vòng 16 giây trong `src/world/neck-pull.ts`. Hủy sẽ khôi phục xương đầu.

## Đại náo từng tầng

Bấm **Đại náo tầng này** để vào sân khấu và chọc phá tại cả 18 tầng. Đứng gần mục tiêu được đánh dấu rồi dùng nút trên màn hình hoặc:

- **F — Đánh quỷ sai:** quỷ choáng 2,8 giây, màn thi hành NPC tạm dừng; sau đó quỷ đuổi người gây sự.
- **G — Phá đồ:** hai cú đập phá giàn/đạo cụ chính hoặc một trong hai thùng dụng cụ. Mảnh vỡ bật ra, quỷ phản ứng rồi đuổi theo; đồ được dựng lại sau 18 giây.
- **R — Kéo quần:** quần ngoài tụt xuống mắt cá, lộ quần đùi trái tim 3D. Quỷ cuống cuồng, kéo quần lại và đuổi khách. Cả ba loại lính đều có trang phục riêng; hình học GLB gốc không bị sửa.
- **Esc** hoặc **Dừng đại náo**: trở về điều khiển tham quan. Vẫn có thể bước ra khỏi sân khấu nếu đang đứng bên trong.

Thanh độ quậy tăng khi ra tay và giảm theo thời gian. Màn diễn cận cảnh bằng video tạm ẩn trong lúc đại náo để tập trung vào phản ứng trực tiếp trong cảnh 3D. Khi điểm thi hành đang có người chơi trải nghiệm, server tạm chặn hành động đại náo. Ngược lại, trải nghiệm mới chờ quỷ dẹp loạn/dựng lại đồ.

`shared/chaos.ts` định nghĩa mục tiêu, loại hành động, phạm vi, hồi chiêu, sát thương và thời hạn. Server duyệt hành động rồi chỉ gửi cho người cùng tầng, đồng thời lưu ảnh chụp trạng thái để người vừa vào thấy đồ vỡ/quần tụt đúng thời hạn. Khi server không kết nối, cùng luật chạy tại máy để chơi đơn. Phản ứng và trang phục nằm tại `src/world/chaos.ts`, `src/world/guard-costume.ts`; ảnh kiểm tra ba lính tại `public/assets/chaos/guard-pranks.png`.

NPC áp giải dừng bên ngoài vùng của người chơi, duy trì khoảng cách tối thiểu 1,3 đơn vị khi tới bắt và dẫn đi. Hồn ma bám theo dấu đường phía sau lệch bên; hai nhân vật nhường nhau khi quay đầu. Góc máy áp giải nhìn từ bên hông. Người xem cùng phòng nhận vị trí, hướng và chuyển động thật của NPC áp giải thay vì vị trí ước lượng sát người chơi.

19 khu vực (chính điện và 18 tầng) được dựng trong `src/world/underworld.ts`, chỉ giữ khu hiện tại trong scene. Tiến độ tham quan được lưu trên thiết bị. Server đồng bộ khu hiện tại để chỉ hiện những người cùng nơi.

## Chạy local

```sh
npm install
npm run dev
```

Mở URL Vite trong terminal. Lệnh `dev` chạy đồng thời client và Colyseus room server tại cổng `2567`. Mở thêm một trình duyệt/ẩn danh để vào cùng phòng và xem đồng bộ người chơi. Có thể đổi địa chỉ room bằng `VITE_ROOM_URL`.

## Điều khiển

- `W A S D` hoặc phím mũi tên: di chuyển.
- `Shift`: chạy.
- Kéo chuột: xoay góc nhìn.
- `E`: tương tác khi đứng gần Tiểu Sai hoặc quầy ghi danh.
- Điện thoại: dùng cụm nút trên màn hình.
- `Esc`: dừng trải nghiệm, đóng bản đồ/phụ đề.

## Tài nguyên

- Concept art: `public/assets/concept/`
- Model rigged: xem `public/models/README.md`
- Âm thanh: xem `public/audio/README.md`
- Video loop môi trường: xem `public/video/README.md`

Nhạc bắt đầu sau nút vào game, với 8 bản nhạc M4A tự soạn theo bối cảnh và hiệu ứng hành động theo khoảng cách. Lời dẫn và thoại chỉ hiển thị bằng phụ đề tiếng Việt, không phát giọng đọc. Phụ đề hoạt động độc lập với nút tắt/bật nhạc và không tự biến mất khi đang đọc.

## Tạo lại và kiểm tra tài nguyên

```sh
npm run assets:characters
npm run assets:music
npm run assets:videos
npm run assets:experience-previews
npm run verify:assets
npm run verify:experience
npm run verify:chaos
npm run build
```

Tạo nhạc cần Python 3 và FFmpeg; tạo video cần FFmpeg. Các file tài nguyên đã có sẵn trong `public`, nên chạy web không cần tạo lại. Video được render bằng CPU từ mesh và skinning thật của cảnh, không gọi dịch vụ bên ngoài. `verify:assets` kiểm tra rig, keyframe, hoạt cảnh, video chuyển động, nhạc không im lặng, phân trang phụ đề không mất nội dung và việc loại bỏ giọng đọc; việc này không thay thế kiểm tra FPS trên thiết bị thực.

`verify:experience` mô phỏng đủ 18 màn trải nghiệm, hủy ở từng giai đoạn, tìm đường tránh sân khấu và hàng chờ độc lập giữa các tầng. Âm phản ứng ngắn dạng nguyên âm trong màn diễn được tổng hợp bằng Web Audio, tuân theo nút tắt âm; không bật lại giọng đọc phụ đề.
