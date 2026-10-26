package com.courtly.exception;

import com.courtly.dto.response.ApiError;
import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public ResponseEntity<ApiError> status(org.springframework.web.server.ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(
            new ApiError(
                e.getReason() == null ? "Không có quyền truy cập" : e.getReason(), Instant.now()));
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiError> accessDenied(AccessDeniedException e) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ApiError("Bạn không có quyền thực hiện thao tác này.", Instant.now()));
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ApiError> methodNotSupported(HttpRequestMethodNotSupportedException e) {
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
        .body(
            new ApiError(
                "Phương thức HTTP (" + e.getMethod() + ") không được hỗ trợ cho tác vụ này.",
                Instant.now()));
  }

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiError> business(BusinessException e) {
    return ResponseEntity.badRequest().body(new ApiError(e.getMessage(), Instant.now()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
    String message =
        e.getBindingResult().getFieldErrors().stream()
            .map(x -> x.getField() + ": " + x.getDefaultMessage())
            .findFirst()
            .orElse("Dữ liệu không hợp lệ");
    return ResponseEntity.badRequest().body(new ApiError(message, Instant.now()));
  }

  @ExceptionHandler({
    DataIntegrityViolationException.class,
    PessimisticLockingFailureException.class
  })
  public ResponseEntity<ApiError> conflict(Exception e) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            new ApiError("Dữ liệu bị trùng hoặc vừa thay đổi. Tải lại và thử lại.", Instant.now()));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    IllegalArgumentException.class
  })
  public ResponseEntity<ApiError> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(new ApiError("Dữ liệu gửi lên không đúng định dạng.", Instant.now()));
  }
}
